import { createCmsValueHandler } from './_cms-blob-store.js';

export default createCmsValueHandler({
  blobFile: 'vls-feature-cards.json',
  key: 'sections',
  emptyValue: []
});
