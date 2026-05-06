import { redirect } from 'next/navigation';

// Merged into /newsletter-tester — redirect any direct hits
export default function NewsletterPromptsRedirect() {
    redirect('/newsletter-tester');
}
