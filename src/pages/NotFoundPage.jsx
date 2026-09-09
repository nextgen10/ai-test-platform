import React from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/primitives';

export default function NotFoundPage() {
    const navigate = useNavigate();

    return (
        <div className="mx-auto max-w-lg py-20 text-center">
            <h1 className="ui-h4 mb-2">Page not found</h1>
            <p className="mb-6 text-subtle">That path is not part of Agent HUB Platform.</p>
            <Button variant="contained" onClick={() => navigate('/')}>
                Back to home
            </Button>
        </div>
    );
}
