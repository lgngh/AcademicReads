// SingleFileApp.js - A Goodreads clone for academic papers with DOI validation and search
// Previous package.json content, but add these dependencies:
/*
  "dependencies": {
    ...previous dependencies...,
    "axios": "^1.6.0",
    "debounce": "^2.0.0"
  }
*/

// Previous schema.prisma content remains the same...

// ------ APP CODE ------

// app/page.js
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import debounce from 'debounce';

export default function Home() {
  const { data: session } = useSession();
  const [papers, setPapers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Debounced search function
  const performSearch = debounce(async (query) => {
    if (!query) {
      const res = await fetch('/api/papers');
      const data = await res.json();
      setPapers(data);
      return;
    }

    const res = await fetch(`/api/papers/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setPapers(data);
  }, 300);

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    performSearch(e.target.value);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <input
          type="text"
          placeholder="Search papers by title, author, or abstract..."
          className="w-full p-2 border rounded"
          value={searchQuery}
          onChange={handleSearch}
        />
      </div>

      {session && (
        <div className="mb-8">
          <a
            href="/papers/new"
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Add New Paper
          </a>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {papers.map(paper => (
          <div key={paper.id} className="border rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-2">{paper.title}</h2>
            <p className="text-gray-600 mb-4">{paper.authors}</p>
            <p className="text-sm text-gray-700 mb-4">{paper.abstract.substring(0, 200)}...</p>
            {paper.doi && (
              <a 
                href={`https://doi.org/${paper.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline text-sm"
              >
                DOI: {paper.doi}
              </a>
            )}
            <div className="mt-4">
              <span className="text-yellow-500">★</span>
              <span className="ml-1">
                {paper.reviews.length > 0 
                  ? (paper.reviews.reduce((acc, r) => acc + r.rating, 0) / paper.reviews.length).toFixed(1)
                  : 'No reviews'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// app/papers/new/page.js
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

export default function NewPaper() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    doi: '',
    title: '',
    authors: '',
    abstract: '',
    publishedYear: new Date().getFullYear()
  });

  // Lookup paper details using DOI
  const lookupDOI = async () => {
    if (!formData.doi) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const response = await axios.get(`https://api.crossref.org/works/${formData.doi}`);
      const work = response.data.message;
      
      setFormData({
        ...formData,
        title: work.title[0],
        authors: work.author.map(a => `${a.given} ${a.family}`).join(', '),
        publishedYear: new Date(work.created['date-time']).getFullYear(),
        abstract: work.abstract || ''
      });
    } catch (err) {
      setError('Could not find paper with this DOI. Please enter details manually.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const res = await fetch('/api/papers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (!res.ok) throw new Error('Failed to create paper');
      
      router.push('/');
    } catch (err) {
      setError('Failed to create paper. Please try again.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6">Add New Paper</h1>
      
      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
          {error}