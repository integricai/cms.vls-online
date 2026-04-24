import { createCmsValueHandler } from './_cms-blob-store.js';

export default createCmsValueHandler({
  blobFile: 'vls-faq.json',
  key: 'sections',
  emptyValue: []
});
