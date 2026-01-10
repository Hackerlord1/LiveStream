// src/app/test/[id]/page.tsx
interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function TestPage({ params }: PageProps) {
    const { id } = await params;

    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold">Test Dynamic Route</h1>
            <p className="mt-4">ID from URL: <code>{id}</code></p>
            <p className="mt-2">Visit: <code>/test/0YcqUK97</code></p>
        </div>
    );
}