import { GenerateRequest, GenerateResponse } from '../types';

export interface Provider {
  generate(request: GenerateRequest): Promise<GenerateResponse>;
}
