import { createCmsValueHandler } from './_cms-blob-store.js';

export default createCmsValueHandler({
  blobFile: 'vls-article-groups.json',
  key: 'sections',
  emptyValue: []
});
