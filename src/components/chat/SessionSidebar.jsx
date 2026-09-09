import React, { useMemo, useState } from 'react';
import { MessageSquare, PanelLeftClose, Plus, Trash2 } from 'lucide-react';

import { useChatContext } from '@/contexts/ChatContext';
import { cx } from '../ui/cx';
import { Button, IconButton, Tooltip } from '../ui/primitives';

function relativeTime(iso) {
    const stamp = /([zZ]|[+-]\d{2}:\d{2})$/.test(iso) ? iso : `${iso}Z`;
    const delta = (Date.now() - new Date(stamp).getTime()) / 1000;
    if (Number.isNaN(delta) || delta < 60) return 'just now';
    if (delta < 3600) return `${Math.floor(delta / 60)}m`;
    if (delta < 86400) return `${Math.floor(delta / 3600)}h`;
    if (delta < 86400 * 14) return `${Math.floor(delta / 86400)}d`;
    return new Date(stamp).toLocaleDateString();
}

export function SessionSidebar({ onCloseMobile, onCollapse }) {
    const {
        sessions,
        hasMoreSessions,
        activeSessionId,
        newChat,
        loadMoreSessions,
        selectSession,
        deleteSession,
    } = useChatContext();
    const [query, setQuery] = useState('');
    const [loadingMore, setLoadingMore] = useState(false);

    const handleNewChat = () => {
        newChat();
        onCloseMobile?.();
    };

    const handleLoadMore = async () => {
        setLoadingMore(true);
        try {
            await loadMoreSessions();
        } finally {
            setLoadingMore(false);
        }
    };

    const handleSelect = (id) => {
        selectSession(id);
        onCloseMobile?.();
    };

    const handleDelete = (id, title) => {
        if (!window.confirm(`Delete “${title || 'this session'}”? This cannot be undone.`)) return;
        deleteSession(id);
    };

    const visible = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return sessions;
        return sessions.filter((session) => (session.title || '').toLowerCase().includes(needle));
    }, [sessions, query]);

    return (
        // A flex item's `min-width` defaults to `auto`, which resolves to its
        // min-content width — so a long session title made this rail wider than
        // the 260px declared here, shoved the transcript across, and pushed the
        // row past a shell that clips horizontally. `truncate` on the titles
        // cannot prevent that on its own; the ancestor has to be allowed to
        // shrink, and the overflow has to be clipped here.
        <div className="flex h-full w-[280px] min-w-0 shrink-0 flex-col overflow-hidden border-r border-hairline bg-elevated md:w-[260px]">
            <div className="border-b border-hairline p-3">
                <div className="mb-2 flex items-center gap-1">
                    {onCollapse && (
                        <Tooltip title="Hide sessions">
                            <IconButton
                                size="small"
                                aria-label="Hide sessions"
                                className="-ml-1 text-subtle"
                                onClick={onCollapse}
                            >
                                <PanelLeftClose size={16} />
                            </IconButton>
                        </Tooltip>
                    )}
                    <span className="text-[0.72rem] font-medium uppercase tracking-wide text-subtle">
                        Sessions
                    </span>
                </div>

                <Button variant="contained" className="w-full py-2 text-[0.84rem]" onClick={handleNewChat}>
                    <Plus size={16} />
                    New chat
                </Button>

                {sessions.length > 6 && (
                    <input
                        className="ui-input mt-2 text-[0.8rem]"
                        placeholder="Filter sessions"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        aria-label="Filter sessions"
                    />
                )}
            </div>

            <div className="custom-scrollbar min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-2">
                {query && hasMoreSessions && (
                    <p className="block px-2 pb-1 text-[0.68rem] text-subtle">
                        Searching the {sessions.length} loaded sessions. Clear the filter to load more.
                    </p>
                )}

                {visible.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                        <p className="text-[0.78rem] text-subtle">
                            {query ? 'No matching sessions.' : 'No sessions yet. Start one above.'}
                        </p>
                    </div>
                ) : (
                    <ul className="mt-1 list-none">
                        {visible.map((session) => {
                            const isActive = session.id === activeSessionId;
                            return (
                                <li key={session.id}>
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => handleSelect(session.id)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' || event.key === ' ') handleSelect(session.id);
                                        }}
                                        className={cx(
                                            'group mb-1 flex min-w-0 cursor-pointer items-center gap-2 border-l-[3px] px-2.5 py-1.5',
                                            isActive
                                                ? 'border-l-brand bg-brand-tint'
                                                : 'border-l-transparent hover:bg-surface-hover',
                                        )}
                                    >
                                        <MessageSquare
                                            size={15}
                                            className={cx('shrink-0', isActive ? 'text-brand' : 'text-subtle')}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p
                                                className={cx(
                                                    'truncate text-[0.82rem]',
                                                    isActive ? 'font-medium text-brand' : 'text-ink',
                                                )}
                                            >
                                                {session.title || 'Untitled'}
                                            </p>
                                            <p className="truncate text-[0.68rem] text-subtle">
                                                {relativeTime(session.last_activity)}
                                            </p>
                                        </div>
                                        <Tooltip title="Delete session">
                                            <IconButton
                                                size="small"
                                                aria-label={`Delete ${session.title || 'this session'}`}
                                                // Revealed on hover on a pointer device, but always
                                                // visible on touch, where there is no hover to reveal it.
                                                className="p-1 text-subtle opacity-100 transition-opacity hover:text-danger focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    handleDelete(session.id, session.title);
                                                }}
                                            >
                                                <Trash2 size={13} />
                                            </IconButton>
                                        </Tooltip>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}

                {hasMoreSessions && !query && (
                    <Button
                        variant="text"
                        size="small"
                        className="mt-1 w-full text-[0.76rem]"
                        disabled={loadingMore}
                        onClick={handleLoadMore}
                    >
                        {loadingMore ? 'Loading…' : 'Show older sessions'}
                    </Button>
                )}
            </div>
        </div>
    );
}
