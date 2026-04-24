import { createCmsValueHandler } from './_cms-blob-store.js';

export default createCmsValueHandler({
  blobFile: 'vls-programs.json',
  key: 'sections',
  emptyValue: []
});
