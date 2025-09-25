// // jest-dom adds custom jest matchers for asserting on DOM nodes.
// // allows you to do things like:
// // expect(element).toHaveTextContent(/react/i)
// // learn more: https://github.com/testing-library/jest-dom
// import '@testing-library/jest-dom';

// Polyfill for TextEncoder/TextDecoder in Node.js test environment
import { TextEncoder, TextDecoder } from "util";

// We do as any because the Node.js TextEncoder/TextDecoder are not the same as the browser TextEncoder/TextDecoder
// but we dont see that difference in our tests.
global.TextEncoder = TextEncoder as any;
global.TextDecoder = TextDecoder as any;
