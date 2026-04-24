import { createCmsValueHandler } from './_cms-blob-store.js';

export default createCmsValueHandler({
  blobFile: 'vls-events.json',
  key: 'events',
  emptyValue: [],
  extraResponseData: function(req, ctx) {
    return { rawUrl: ctx.selfUrl };
  }
});
