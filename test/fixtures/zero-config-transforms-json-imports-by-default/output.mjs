import _packageJson from '../../package.json';
const { main1 } = _packageJson;
import _packageJson2 from './package.json';
const { main2 } = _packageJson2;
import _pacakgeJson from '../pacakge.json';
const { main3 } = _pacakgeJson;
import _packageJson3 from '.././package.json';
const { main4 } = _packageJson3;
import { main5 } from 'package.json';
import { main6 } from '.package.json';
import _packageJson4 from './package.json';
const { main7 } = _packageJson4;
const result = `
${main1}
${main2}
${main3}
${main4}
${main5}
${main6}
${main7}
`;
export default result;
