import { Component, type ErrorInfo, type ReactNode } from "react";
import { captureException } from "../lib/analytics";

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
    captureException(error, { componentStack: info.componentStack });
  }

  render() {
    if (this.state.error) {
      return this.props.fallback ?? (
        <div className="error-boundary">
          <h2 className="text-h2">Something went wrong</h2>
          <p className="text-body">{this.state.error.message}</p>
          <button className="btn-ghost" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
