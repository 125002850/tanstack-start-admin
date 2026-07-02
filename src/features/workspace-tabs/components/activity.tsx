import * as React from 'react';

/**
 * Keep-alive host primitive backed by React 19 Activity.
 * `hidden` mode preserves subtree state while taking it out of layout/paint,
 * but React cleans up child Effects while hidden and re-mounts them when shown.
 * Page Effects hosted here must tolerate repeated mount/cleanup cycles.
 */
export const Activity = React.Activity;
