import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

import { Button } from './ui/primitives';

/**
 * The last line of defence.
 *
 * React unmounts the whole tree when a render throws, so without this a single
 * bad field in an API response paints a blank page. Showing the message and a
 * way back is worth more than a stack trace nobody sees.
 */
export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error('Global Error Boundary caught an error:', error, info);
    }

    render() {
        const { error } = this.state;
        if (!error) return this.props.children;

        return (
            <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-6 px-4 text-center">
                <AlertTriangle size={64} className="text-brand" />
                <div>
                    <h1 className="ui-h4 mb-2">Something went wrong</h1>
                    <p className="mx-auto mb-6 max-w-md text-subtle">
                        An unexpected error occurred in the application. The technical details have been
                        logged.
                    </p>
                    <p className="ui-code mb-6 block text-left">
                        {error.message || 'Unknown runtime error'}
                    </p>
                </div>
                <Button variant="contained" onClick={() => this.setState({ error: null })}>
                    <RefreshCw size={18} />
                    Try again
                </Button>
            </div>
        );
    }
}
