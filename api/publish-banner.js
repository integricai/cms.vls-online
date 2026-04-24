import { createCmsValueHandler } from './_cms-blob-store.js';

export default createCmsValueHandler({
  blobFile: 'vls-banners.json',
  key: 'banners',
  emptyValue: []
});
