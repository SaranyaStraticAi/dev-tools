import { LinkHeader } from './_components/LinkHeader';
import { LinkForm } from './_components/LinkForm';

export default function LinkTracker() {
    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] p-4 md:p-8 pt-20">
            <div className="max-w-3xl mx-auto space-y-8">
                <LinkHeader />
                <LinkForm />
            </div>
        </div>
    );
}
