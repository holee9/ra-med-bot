import { DocClass } from '../doc-class';
import { makeGenericChunker } from './generic';
export const chunkSubmissionMfds = makeGenericChunker(DocClass.submission_inprogress);
export const chunkSubmissionInprogress = makeGenericChunker(DocClass.submission_inprogress);
