
import type { HandlerSlot } from "../../engine/handler-registry.ts";
import type { HandlerActionRef } from "../../engine/types.ts";


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
}


export interface ProcessCompileFailure {
    
    id: string;
    error: unknown;
}
