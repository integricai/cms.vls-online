import { createCmsValueHandler } from './_cms-blob-store.js';

export default createCmsValueHandler({
  blobFile: 'vls-header-config.json',
  key: 'config',
  emptyValue: null
});
