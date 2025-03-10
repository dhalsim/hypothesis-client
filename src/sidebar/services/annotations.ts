import { generateHexString } from '../../shared/random';
import type { AnnotationData } from '../../types/annotator';
import type {
  APIAnnotationData,
  SavedAnnotation,
  Annotation,
} from '../../types/api';

import * as metadata from '../helpers/annotation-metadata';
import {
  defaultPermissions,
  privatePermissions,
  sharedPermissions,
} from '../helpers/permissions';
import type { SidebarStore } from '../store';

import type { NostrPublisherService } from './nostr-publisher';

/**
 * A service for creating, updating and persisting annotations both in the
 * local store and on the backend via the API.
 */
// @inject
export class AnnotationsService {
  private _nostrPublisherService: NostrPublisherService;
  private _store: SidebarStore;

  constructor(
    nostrPublisherService: NostrPublisherService,
    store: SidebarStore,
  ) {
    this._nostrPublisherService = nostrPublisherService;
    this._store = store;
  }

  /**
   * Apply changes for the given `annotation` from its draft in the store (if
   * any) and return a new object with those changes integrated.
   */
  private _applyDraftChanges(annotation: Annotation): Annotation {
    const changes: Partial<Annotation> = {};
    const draft = this._store.getDraft(annotation);

    if (draft) {
      changes.tags = draft.tags;
      changes.text = draft.text;
      changes.permissions = draft.isPrivate
        ? privatePermissions(annotation.user)
        : sharedPermissions(annotation.user, annotation.group);
    }

    // Integrate changes from draft into object to be persisted
    return { ...annotation, ...changes };
  }

  /**
   * Create a new {@link Annotation} object from a set of field values.
   *
   * All fields not set in `annotationData` will be populated with default
   * values.
   */
  annotationFromData(
    annotationData: 
      Partial<APIAnnotationData> & Pick<APIAnnotationData, 'uri' | 'target'>,
    now: Date = new Date()
  ): Annotation {
    const defaultPrivacy = this._store.getDefault('annotationPrivacy');
    const groupid = this._store.focusedGroupId();
    const profile = this._store.getNostrProfile();

    if (!groupid) {
      throw new Error('Cannot create annotation without a group');
    }

    if (!profile) {
      throw new Error('Cannot create annotation when logged out');
    }

    const userInfo = { display_name: profile.displayName };

    // We need a unique local/app identifier for this new annotation such
    // that we might look it up later in the store. It won't have an ID yet,
    // as it has not been persisted to the service.
    const $tag = `s:${generateHexString(8)}`;
    const annotation: Omit<Annotation, 'nostr_event' | 'id'> = Object.assign(
      {
        created: now.toISOString(),
        group: groupid,
        permissions: defaultPermissions(profile.publicKeyHex, groupid, defaultPrivacy),
        tags: [],
        text: '',
        updated: now.toISOString(),
        user: profile.publicKeyHex,
        user_info: userInfo,
        $tag,
        hidden: false,
        links: {},
        document: { title: '' },
      },
      annotationData,
    );

    // Highlights are peculiar in that they always have private permissions
    if (metadata.isHighlight(annotation)) {
      annotation.permissions = privatePermissions(profile.publicKeyHex);
    }

    return annotation;
  }

  /**
   * Populate a new annotation object from `annotation` and add it to the store.
   * Create a draft for it unless it's a highlight and clear other empty
   * drafts out of the way.
   */
  create(
    annotationData: Omit<AnnotationData, '$tag' | 'id' | 'nostr_event'>, 
    now = new Date()
  ) {
    const annotation = this.annotationFromData(annotationData, now);

    this._store.addAnnotations([annotation]);

    // Remove other drafts that are in the way, and their annotations (if new)
    this._store.deleteNewAndEmptyDrafts();

    // Create a draft unless it's a highlight
    if (!metadata.isHighlight(annotation)) {
      this._store.createDraft(annotation, {
        tags: annotation.tags,
        text: annotation.text,
        isPrivate: !metadata.isPublic(annotation),
      });
    }

    // NB: It may make sense to move the following code at some point to
    // the UI layer
    // Select the correct tab
    // If the annotation is of type note or annotation, make sure
    // the appropriate tab is selected. If it is of type reply, user
    // stays in the selected tab.
    if (metadata.isPageNote(annotation)) {
      this._store.selectTab('note');
    } else if (metadata.isAnnotation(annotation)) {
      this._store.selectTab('annotation');
    }

    (annotation.references || []).forEach(parent => {
      // Expand any parents of this annotation.
      this._store.setExpanded(parent, true);
    });
  }

  /**
   * Create a new empty "page note" annotation and add it to the store. If the
   * user is not logged in, open the `loginPrompt` panel instead.
   */
  createPageNote() {
    const topLevelFrame = this._store.mainFrame();
    
    if (!this._store.isNostrLoggedIn()) {
      this._store.openSidebarPanel('nostrConnectPanel');
      
      return;
    }
    
    if (!topLevelFrame) {
      return;
    }
    
    const pageNoteAnnotation = {
      target: [
        {
          source: topLevelFrame.uri,
        },
      ],
      uri: topLevelFrame.uri,
    };
    
    this.create(pageNoteAnnotation);
  }

  /**
   * Flag an annotation for review by a moderator.
   */
  async flag(annotation: SavedAnnotation) {
    // TODO: nostr: flag
    // await this._api.annotation.flag({ id: annotation.id });    
    this._store.updateFlagStatus(annotation.id, true);
  }

  /**
   * Create a reply to `annotation` by the user `userid` and add to the store.
   */
  reply(annotation: SavedAnnotation, userid: string) {
    const replyAnnotation = {
      group: annotation.group,
      permissions: metadata.isPublic(annotation)
        ? sharedPermissions(userid, annotation.group)
        : privatePermissions(userid),
      references: (annotation.references || []).concat(annotation.id),
      target: [{ source: annotation.target[0].source }],
      uri: annotation.uri,
    };
    this.create(replyAnnotation);
  }

  /**
   * Save new (or update existing) annotation. On success,
   * the annotation's `Draft` will be removed and the annotation added
   * to the store.
   */
  async save(annotation: Annotation) {
    if (metadata.isSaved(annotation)) {
      throw new Error('Cannot save saved annotation');
    }
    
    let saved: () => Promise<SavedAnnotation>;
    
    const annotationWithChanges = this._applyDraftChanges(annotation);

    if (metadata.isReply(annotation)) {
      const parentAnnotation = this._store.findAnnotationByID(
        annotation.references?.[annotation.references.length - 1] as string
      );

      if (!parentAnnotation) {
        throw new Error('Parent annotation not found');
      }

      const rootAnnotation = this._store.findAnnotationByID(
        annotation.references?.[0] as string
      );

      if (!rootAnnotation) {
        throw new Error('Root annotation not found');
      }

      const isRootPageNote = metadata.isPageNote(rootAnnotation);

      saved = isRootPageNote
        ? () => this._nostrPublisherService.publishPageNoteReply({
            parentAnnotation,
            annotation: annotationWithChanges,
          })
        : () => this._nostrPublisherService.publishAnnotationReply({
            parentAnnotation,
            annotation: annotationWithChanges,
          });
    } else {
      saved = metadata.isPageNote(annotation)
        ? () => this._nostrPublisherService.publishPageNote(annotationWithChanges)
        : () => this._nostrPublisherService.publishAnnotation(annotationWithChanges);
    }

    let savedAnnotation: SavedAnnotation;
    
    this._store.annotationSaveStarted(annotation);
    
    try {
      savedAnnotation = await saved();
    } finally {
      this._store.annotationSaveFinished(annotation);
    }

    // Copy local/internal fields from the original annotation to the saved
    // version.
    for (const [key, value] of Object.entries(annotation)) {
      if (key.startsWith('$')) {
        const fields: Record<string, any> = savedAnnotation;
        fields[key] = value;
      }
    }

    // Clear out any pending changes (draft)
    this._store.removeDraft(annotation);
    this._store.removeAnnotations([annotation]);
    
    return savedAnnotation;
  }
}
