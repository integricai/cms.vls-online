import { createCmsValueHandler } from './_cms-blob-store.js';

export default createCmsValueHandler({
  blobFile: 'vls-form-config.json',
  key: 'config',
  emptyValue: null
});
