import { redirect } from 'next/navigation';

/** The demo has no login. Keep the route so old bookmarks do not 404. */
export default function LoginPage() {
    redirect('/');
}
