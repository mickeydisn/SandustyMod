
import type { HandlerSlot } from "../core/handler-registry.ts";
import type { HandlerActionRef } from "../core/types.ts";


export type ProcessStep = HandlerActionRef;


export interface ProcessRef {
    
    id: string;
}


export interface CustomProcessConfig {
    
    id: string;
    
    name?: string;
    
    doc?: string;
    
    scope: HandlerSlot;
    
    steps: ProcessStep[];
    
    derived?: boolean;
    
    derivedFrom?: string;
}


export interface ProcessCompileFailure {
    
    id: string;
    error: unknown;
}
