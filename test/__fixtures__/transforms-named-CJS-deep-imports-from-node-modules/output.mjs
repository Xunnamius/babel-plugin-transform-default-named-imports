// ? Import from things we are pretty confident will remain CJS modules
import _typesNodeDeepImport from '@types/node/deep/import';
const { Fake, Include } = _typesNodeDeepImport;
import _typesJestDeepImport from '@types/jest/deep/import';
const { Fake2, Include2 } = _typesJestDeepImport;
void Fake;
void Include;
void Fake2;
void Include2;
