/**
 * State Machine Module
 * 
 * Manages application states and state transitions for the focus-core module.
 * States: IDLE, FOCUSING, DISTRACTED, SHORT_BREAK, LONG_BREAK, ENDING
 */

export enum AppState {
  IDLE = 'IDLE',
  FOCUSING = 'FOCUSING',
  DISTRACTED = 'DISTRACTED',
  SHORT_BREAK = 'SHORT_BREAK',
  LONG_BREAK = 'LONG_BREAK',
  ENDING = 'ENDING'
}

export type StateTransitionEvent =
  | { type: 'START_FOCUS'; durationMinutes: number }
  | { type: 'DISTRACTION_DETECTED' }
  | { type: 'DISTRACTION_ANIMATION_COMPLETE' }
  | { type: 'ROUND_COMPLETE'; shouldShowEnding: boolean; isLongBreak: boolean }
  | { type: 'BREAK_COMPLETE' }
  | { type: 'SKIP_BREAK' }
  | { type: 'ABANDON_ROUND' }
  | { type: 'ENDING_CONFIRMED' }
  | { type: 'DIVE_AGAIN' };

export interface TransitionResult {
  success: boolean;
  newState: AppState;
  error?: string;
}

export interface StateMachine {
  currentState: AppState;
  
  // 狀態轉換
  transition(event: StateTransitionEvent): TransitionResult;
  
  // 查詢
  canTransition(event: StateTransitionEvent): boolean;
  getState(): AppState;
}

export class StateMachineImpl implements StateMachine {
  public currentState: AppState;
  
  constructor(initialState: AppState = AppState.IDLE) {
    this.currentState = initialState;
  }
  
  getState(): AppState {
    return this.currentState;
  }
  
  canTransition(event: StateTransitionEvent): boolean {
    // Check if the transition is legal by attempting it
    const result = this.checkTransition(this.currentState, event);
    return result.success;
  }
  
  transition(event: StateTransitionEvent): TransitionResult {
    const result = this.checkTransition(this.currentState, event);
    
    if (result.success) {
      this.currentState = result.newState;
    }
    
    return result;
  }
  
  private checkTransition(state: AppState, event: StateTransitionEvent): TransitionResult {
    switch (state) {
      case AppState.IDLE:
        return this.transitionFromIdle(event);
      
      case AppState.FOCUSING:
        return this.transitionFromFocusing(event);
      
      case AppState.DISTRACTED:
        return this.transitionFromDistracted(event);
      
      case AppState.SHORT_BREAK:
        return this.transitionFromShortBreak(event);
      
      case AppState.LONG_BREAK:
        return this.transitionFromLongBreak(event);
      
      case AppState.ENDING:
        return this.transitionFromEnding(event);
      
      default:
        return {
          success: false,
          newState: state,
          error: `Unknown state: ${state}`
        };
    }
  }
  
  private transitionFromIdle(event: StateTransitionEvent): TransitionResult {
    switch (event.type) {
      case 'START_FOCUS':
        // Validate duration
        if (event.durationMinutes <= 0) {
          return {
            success: false,
            newState: AppState.IDLE,
            error: 'Invalid duration: must be greater than 0'
          };
        }
        return {
          success: true,
          newState: AppState.FOCUSING
        };
      
      case 'DIVE_AGAIN':
        // IDLE → IDLE (when endingSeen=true)
        return {
          success: true,
          newState: AppState.IDLE
        };
      
      default:
        return {
          success: false,
          newState: AppState.IDLE,
          error: `Illegal transition from IDLE with event: ${event.type}`
        };
    }
  }
  
  private transitionFromFocusing(event: StateTransitionEvent): TransitionResult {
    switch (event.type) {
      case 'DISTRACTION_DETECTED':
        return {
          success: true,
          newState: AppState.DISTRACTED
        };
      
      case 'ROUND_COMPLETE':
        // Determine next state based on flags
        if (event.shouldShowEnding) {
          return {
            success: true,
            newState: AppState.ENDING
          };
        } else if (event.isLongBreak) {
          return {
            success: true,
            newState: AppState.LONG_BREAK
          };
        } else {
          return {
            success: true,
            newState: AppState.SHORT_BREAK
          };
        }
      
      case 'ABANDON_ROUND':
        return {
          success: true,
          newState: AppState.IDLE
        };
      
      default:
        return {
          success: false,
          newState: AppState.FOCUSING,
          error: `Illegal transition from FOCUSING with event: ${event.type}`
        };
    }
  }
  
  private transitionFromDistracted(event: StateTransitionEvent): TransitionResult {
    switch (event.type) {
      case 'DISTRACTION_ANIMATION_COMPLETE':
        return {
          success: true,
          newState: AppState.FOCUSING
        };
      
      case 'ABANDON_ROUND':
        return {
          success: true,
          newState: AppState.IDLE
        };
      
      default:
        return {
          success: false,
          newState: AppState.DISTRACTED,
          error: `Illegal transition from DISTRACTED with event: ${event.type}`
        };
    }
  }
  
  private transitionFromShortBreak(event: StateTransitionEvent): TransitionResult {
    switch (event.type) {
      case 'BREAK_COMPLETE':
      case 'SKIP_BREAK':
        return {
          success: true,
          newState: AppState.IDLE
        };
      
      default:
        return {
          success: false,
          newState: AppState.SHORT_BREAK,
          error: `Illegal transition from SHORT_BREAK with event: ${event.type}`
        };
    }
  }
  
  private transitionFromLongBreak(event: StateTransitionEvent): TransitionResult {
    switch (event.type) {
      case 'BREAK_COMPLETE':
      case 'SKIP_BREAK':
        return {
          success: true,
          newState: AppState.IDLE
        };
      
      default:
        return {
          success: false,
          newState: AppState.LONG_BREAK,
          error: `Illegal transition from LONG_BREAK with event: ${event.type}`
        };
    }
  }
  
  private transitionFromEnding(event: StateTransitionEvent): TransitionResult {
    switch (event.type) {
      case 'ENDING_CONFIRMED':
      case 'DIVE_AGAIN':
        return {
          success: true,
          newState: AppState.IDLE
        };
      
      default:
        return {
          success: false,
          newState: AppState.ENDING,
          error: `Illegal transition from ENDING with event: ${event.type}`
        };
    }
  }
}

// Factory function for creating state machines
export function createStateMachine(initialState?: AppState): StateMachine {
  return new StateMachineImpl(initialState);
}
