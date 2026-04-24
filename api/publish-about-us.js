import { createCmsValueHandler } from './_cms-blob-store.js';

export default createCmsValueHandler({
  blobFile: 'vls-about-us.json',
  key: 'sections',
  emptyValue: []
});
