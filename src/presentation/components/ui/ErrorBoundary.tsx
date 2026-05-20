import { Component, type ReactNode } from 'react';
import { logger } from '@/infrastructure/logging/logger';

interface Props {
  children: ReactNode;
  fallback: ReactNode;
  /** Optional label used in the log message for easier grep. */
  logTag?: string;
}

interface State {
  caught: boolean;
}

/**
 * Class component required by React's error boundary API.
 * Catches render/lifecycle errors in the subtree and shows `fallback` instead.
 * Logs the error with the optional tag so it's grep-able alongside error codes.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { caught: false };

  static getDerivedStateFromError(): State {
    return { caught: true };
  }

  componentDidCatch(error: Error): void {
    const tag = this.props.logTag ?? 'ErrorBoundary';
    logger.fromError(`${tag}:caught`, error);
  }

  render(): ReactNode {
    return this.state.caught ? this.props.fallback : this.props.children;
  }
}
