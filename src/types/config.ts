import type { FocusUserInfo } from './rpc';

/**
 * Configuration for an annotation service.
 *
 * See https://h.readthedocs.io/projects/client/en/latest/publishers/config/#cmdoption-arg-services
 *
 *  The `onXXX` functions may be set by the embedder of the client. The
 * `onXXXProvided` booleans are correspondingly set in the annotator if a
 *  particular function is provided.
 */
export type Service = {  
  icon?: string;
  /**
   * List of IDs of groups to show. If the embedder specifies "$rpc:requestGroups",
   * the list of groups is fetched from a parent frame and `groups` is
   * replaced with a promise to represent the result.
   */
  groups?: string[];

  onHelpRequest?: () => void;
  onHelpRequestProvided?: boolean;
  onLoginRequest?: () => void;
  onLoginRequestProvided?: boolean;
  onLogoutRequest?: () => void;
  onLogoutRequestProvided?: boolean;
  onSignupRequest?: () => void;
  onSignupRequestProvided?: boolean;
  onProfileRequest?: () => void;
  onProfileRequestProvided?: boolean;
};

/**
 * Configuration for the sidebar app set by the Hypothesis backend ("h")
 * or baked into the sidebar app at build time (in the browser extension).
 *
 * See `h.views.client` in the "h" application.
 */
export type ConfigFromSidebar = {
  nostrProfileUrl?: string;
  nostrEventUrl?: string;
  nostrSearchUrl?: string;
};

export type AnnotationEventType = 'create' | 'flag';

/**
 * An "embedder frame" may provide configuration to be notified (via JSON RPC)
 * of qualifying annotation activity from the sidebar frame.
 */
export type ReportAnnotationActivityConfig = {
  /** Name of RPC method to call in embedded frame on qualifying annotation activity. */
  method: string;
  /** Which events to notify about. */
  events: AnnotationEventType[];
};

export type DashboardConfig = {
  /**
   * Whether the dashboard entry point should be displayed in the profile menu
   * or not.
   * Typically, only instructors should see this option.
   */
  showEntryPoint: boolean;

  /** Name of the RPC method to get a valid auth token */
  authTokenRPCMethod: string;

  /**
   * Entry point for the dashboard, where the first request needs to happen to
   * get authenticated.
   */
  entryPointURL: string;

  /** The name of the form field containing the auth token */
  authFieldName: string;
};

/**
 * Configure the client to focus on a specific subset of annotations.
 *
 * This hides annotations which do not match the filter when the client starts,
 * and shows an option to toggle the filters on or off.
 *
 * This is used in the LMS for example when a teacher is grading a specific
 * student's annotations or in an assignment where students are being directed
 * to annotate a specific chapter.
 */
export type FocusConfig = {
  /** Specify a range of content in an ebook as a CFI range. */
  cfi?: {
    /**
     * CFI range specified as `[startCFI]-[endCFI]`. The range is exclusive of
     * the end point.
     */
    range: string;
    /** Descriptive label for this CFI range. */
    label: string;
  };

  /**
   * Page range in the form `[start]-[end]`. The range is inclusive of the
   * end page.
   */
  pages?: string;

  user?: FocusUserInfo;
};

/**
 * List of theme elements which can be customized.
 */
export type ThemeProperty =
  | 'accentColor'
  | 'annotationFontFamily'
  | 'appBackgroundColor'
  | 'ctaBackgroundColor'
  | 'ctaTextColor'
  | 'selectionFontFamily';

/**
 * Configuration provided by the annotator ("host frame") as
 * `ConfigFromAnnotator` OR by an ancestor ("embedder frame") as
 * `ConfigFromEmbedder`.
 *
 * This is mostly a subset of keys from
 * https://h.readthedocs.io/projects/client/en/latest/publishers/config/ which
 * excludes any keys used only by the "annotator" part of the application.
 */
export type ConfigFromHost = {
  /** Direct-linked annotation ID. */
  annotations?: string;

  focus?: FocusConfig;

  /** Direct-linked group ID */
  group?: string;

  /** Initial filter query. */
  query?: string;

  /** Method used to load the client (extension, Via proxy, embedded by publisher etc.) */
  appType?: string;

  /** Whether to open the sidebar on the initial load. */
  openSidebar?: boolean;

  /** Whether to show highlights. */
  showHighlights?: boolean;

  /** Theme properties (fonts, colors etc.) */
  branding?: Record<ThemeProperty, string>;

  /** Whether to show the "New note" button on the "Page notes" tab. */
  enableExperimentalNewNoteButton?: boolean;

  /** Configuration for the annotation services that the client connects to. */
  services?: Service[];

  /** Name of the base theme to use. */
  theme?: string;

  /** URL template for username links. */
  usernameUrl?: string;

  /** URL for the nostr profile page. */
  nostrProfileUrl?: string;

  /** URL for the nostr event page. */
  nostrEventUrl?: string;

  /** URL template for nostr search. */
  nostrSearchUrl?: string;
};

/**
 * `SidebarSettings` are created by merging "sidebar configuration"
 * (`ConfigFromSidebar`) with  "host configuration" (either
 * `ConfigFromAnnotator` OR `ConfigFromEmbedder`).
 *
 * In all cases, the annotator ("host frame") provides `ConfigFromAnnotator`
 * to the sidebar frame by encoding values into a URL fragment on the sidebar
 * frame's `src` attribute.
 *
 * In most cases, `SidebarSettings` combine `ConfigFromAnnotator` with
 * `ConfigFromSidebar`:
 *
 * +--------------------------------------------+
 * |        host frame (annotator)              |
 * |                 +-----------------------+  |
 * |                 |  sidebar frame        |  |
 * |                 |                       |  |
 * | <ConfigFromAnnotator> => iframe.src     |  |
 * |                 |                       |  |
 * |                 |                       |  |
 * |                 |                       |  |
 * |                 | <ConfigFromSidebar>   |  |
 * |                 +-----------------------+  |
 * +--------------------------------------------+
 *
 * In some cases (e.g. LMS), host configuration should instead be provided by an
 * ancestor ("embedder") frame. This is signaled by the presence of a valid
 * `requestConfigFromFrame` object on `ConfigFromAnnotator`.
 *
 * `ConfigFromEmbedder` will then be requested from the designated embedder
 * frame and combined with `ConfigFromSidebar` to produce `SidebarSettings`:
 *
 * +------------------------------------------------------------------------+
 * |                                         embedder frame                 |
 * |  +------------------------------------------+                          |
 * |  |        host frame (annotator)            |                          |
 * |  |                 +---------------------+  |                          |
 * |  |                 |  sidebar frame      |  |                          |
 * |  |                 |                     |  |                          |
 * |  | <ConfigFromAnnotator> => iframe.src   |  |                          |
 * |  |   requestConfigFromFrame              |  |                          |
 * |  |                 |                     |  |                          |
 * |  |                 |                     |  |                          |
 * |  |                 |       <====postMessage====> <ConfigFromEmbedder>  |
 * |  |                 | <ConfigFromSidebar> |  |                          |
 * |  |                 +---------------------+  |                          |
 * |  +------------------------------------------+                          |
 * +------------------------------------------------------------------------+
 */

export type SidebarSettings = ConfigFromHost &
  ConfigFromSidebar;
