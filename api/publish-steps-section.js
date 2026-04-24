import { createCmsValueHandler } from './_cms-blob-store.js';

export default createCmsValueHandler({
  blobFile: 'vls-steps-sections.json',
  key: 'sections',
  emptyValue: []
});
