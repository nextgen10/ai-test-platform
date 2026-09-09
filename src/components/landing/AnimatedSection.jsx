import React, { useEffect, useRef, useState } from 'react';

import { cx } from '../ui/cx';

/**
 * A subtle fade-up as a section scrolls into view.
 *
 * An IntersectionObserver and two CSS properties, rather than an animation
 * library: this is the only motion on the page that needs a scroll trigger, and
 * `prefers-reduced-motion` is honoured by the transition itself.
 */
export default function AnimatedSection({ children, delay = 0, className, id }) {
    const ref = useRef(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const node = ref.current;
        if (!node) return undefined;

        // Without IntersectionObserver the content must still be readable, so
        // show it rather than leaving a permanently transparent section.
        if (typeof IntersectionObserver === 'undefined') {
            setVisible(true);
            return undefined;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisible(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '-50px' },
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    return (
        <div
            ref={ref}
            id={id}
            className={cx(
                'transition-[opacity,transform] duration-[600ms] ease-[cubic-bezier(0.25,0.1,0.25,1)] motion-reduce:translate-y-0',
                visible ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0',
                className,
            )}
            style={{ transitionDelay: `${delay}s` }}
        >
            {children}
        </div>
    );
}
