/**
 * Store module which tracks activity happening in the application that may
 * need to be reflected in the UI.
 */
import type { Annotation } from '../../../types/api';
import { createStoreModule, makeAction } from '../create-store';

export type State = {
  /**
   * Annotation `$tag`s that correspond to annotations with active API requests
   */
  activeAnnotationSaveRequests: string[];

  /** The number of API requests that have started and not yet completed. */
  activeApiRequests: number;
  /** The number of annotation fetches that have started and not yet completed. */
  activeAnnotationFetches: number;
  /** Have annotations ever been fetched? */
  hasFetchedAnnotations: boolean;

  /**
   * The number of total annotation results the service reported as
   * matching the most recent load/search request
   */
  annotationResultCount: number | null;

  /** Count of remaining annotation imports. */
  importsPending: number;

  /** Total number of imports in active import tasks. */
  importsTotal: number;
};

const initialState: State = {
  activeAnnotationSaveRequests: [],
  activeApiRequests: 0,
  activeAnnotationFetches: 0,
  hasFetchedAnnotations: false,
  annotationResultCount: null,
  importsPending: 0,
  importsTotal: 0,
};

const reducers = {
  API_REQUEST_STARTED(state: State, action: { serviceName: string }) {
    // eslint-disable-next-line no-console
    console.log('API_REQUEST_STARTED', action.serviceName);

    return {
      ...state,
      activeApiRequests: state.activeApiRequests + 1,
    };
  },

  API_REQUEST_FINISHED(state: State, action: { serviceName: string }) {
    // eslint-disable-next-line no-console
    console.log('API_REQUEST_FINISHED', action.serviceName);
    
    if (state.activeApiRequests === 0) {
      throw new Error(
        'API_REQUEST_FINISHED action when no requests were active',
      );
    }

    return {
      ...state,
      activeApiRequests: state.activeApiRequests - 1,
    };
  },

  ANNOTATION_SAVE_STARTED(state: State, action: { annotation: Annotation }) {
    const addToStarted = [];
    if (
      action.annotation.$tag &&
      !state.activeAnnotationSaveRequests.includes(action.annotation.$tag)
    ) {
      addToStarted.push(action.annotation.$tag);
    }
    
    const updatedSaves =
      state.activeAnnotationSaveRequests.concat(addToStarted);
    
    return {
      ...state,
      activeAnnotationSaveRequests: updatedSaves,
    };
  },

  ANNOTATION_SAVE_FINISHED(state: State, action: { annotation: Annotation }) {
    const updatedSaves = state.activeAnnotationSaveRequests.filter(
      $tag => $tag !== action.annotation.$tag,
    );
    
    return {
      ...state,
      activeAnnotationSaveRequests: updatedSaves,
    };
  },

  ANNOTATION_FETCH_STARTED(state: State) {
    return {
      ...state,
      activeAnnotationFetches: state.activeAnnotationFetches + 1,
    };
  },

  ANNOTATION_FETCH_FINISHED(state: State) {
    if (state.activeAnnotationFetches === 0) {
      throw new Error(
        'ANNOTATION_FETCH_FINISHED action when no annotation fetches were active',
      );
    }

    return {
      ...state,
      hasFetchedAnnotations: true,
      activeAnnotationFetches: state.activeAnnotationFetches - 1,
    };
  },

  SET_ANNOTATION_RESULT_COUNT(state: State, action: { resultCount: number }) {
    return {
      annotationResultCount: action.resultCount,
    };
  },

  BEGIN_IMPORT(state: State, action: { count: number }) {
    return {
      importsPending: state.importsPending + action.count,
      importsTotal: state.importsTotal + action.count,
    };
  },

  COMPLETE_IMPORT(state: State, action: { count: number }) {
    if (!state.importsPending) {
      return state;
    }
    const importsPending = Math.max(state.importsPending - action.count, 0);
    const importsTotal = importsPending > 0 ? state.importsTotal : 0;

    return {
      importsPending,
      importsTotal,
    };
  },
};

function annotationFetchStarted() {
  return makeAction(reducers, 'ANNOTATION_FETCH_STARTED', undefined);
}

function annotationFetchFinished() {
  return makeAction(reducers, 'ANNOTATION_FETCH_FINISHED', undefined);
}

function annotationSaveStarted(annotation: Annotation) {
  return makeAction(reducers, 'ANNOTATION_SAVE_STARTED', { annotation });
}

function annotationSaveFinished(annotation: Annotation) {
  return makeAction(reducers, 'ANNOTATION_SAVE_FINISHED', { annotation });
}

function apiRequestStarted(serviceName: string) {
  return makeAction(reducers, 'API_REQUEST_STARTED', { serviceName });
}

function apiRequestFinished(serviceName: string) {
  return makeAction(reducers, 'API_REQUEST_FINISHED', { serviceName });
}

function setAnnotationResultCount(resultCount: number) {
  return makeAction(reducers, 'SET_ANNOTATION_RESULT_COUNT', { resultCount });
}

function beginImport(count: number) {
  return makeAction(reducers, 'BEGIN_IMPORT', { count });
}

function completeImport(count: number) {
  return makeAction(reducers, 'COMPLETE_IMPORT', { count });
}

/** Selectors */

function annotationResultCount(state: State) {
  return state.annotationResultCount;
}

function hasFetchedAnnotations(state: State) {
  return state.hasFetchedAnnotations;
}

function importsPending(state: State) {
  return state.importsPending;
}

function importsTotal(state: State) {
  return state.importsTotal;
}

/**
 * Return true when annotations are actively being fetched.
 */
function isFetchingAnnotations(state: State) {
  return state.activeAnnotationFetches > 0;
}

/**
 * Return true when any activity is happening in the app that needs to complete
 * before the UI is ready for interactivity with annotations.
 */
function isLoading(state: State) {
  return state.activeApiRequests > 0 || !state.hasFetchedAnnotations;
}

/**
 * Return `true` if `$tag` exists in the array of annotation `$tag`s that
 * have in-flight save requests, i.e. the annotation in question is actively
 * being saved to a remote service.
 */
function isSavingAnnotation(state: State, annotation: Annotation) {
  if (!annotation.$tag) {
    return false;
  }
  return state.activeAnnotationSaveRequests.includes(annotation.$tag);
}

export const activityModule = createStoreModule(initialState, {
  reducers,
  namespace: 'activity',

  actionCreators: {
    annotationFetchStarted,
    annotationFetchFinished,
    annotationSaveStarted,
    annotationSaveFinished,
    apiRequestStarted,
    apiRequestFinished,
    beginImport,
    completeImport,
    setAnnotationResultCount,
  },

  selectors: {
    hasFetchedAnnotations,
    importsPending,
    importsTotal,
    isLoading,
    isFetchingAnnotations,
    isSavingAnnotation,
    annotationResultCount,
  },
});
