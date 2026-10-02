
import type { HandlerSlot } from "../../engine/handler-registry.ts";
import type { HandlerActionRef } from "../../engine/types.ts";

export type ProcessStep = HandlerActionRef;

export interface CustomProcessConfig {
    /** The id configs refer to this process by. */
    
    id: string;
    
    name?: string;
    
    doc?: string;
    
    /** The call site this process was built for. */
    scope: HandlerSlot;
    
    steps: ProcessStep[];
}

