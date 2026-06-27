import { collection, getDocs, query, where } from 'firebase/firestore';
import { stories as localStories } from '../data/content.js';
import { db, firebaseReady } from './firebase.js';

function normalizeStory(snapshot) {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    title: data.title || 'Historia sin título',
    slug: data.slug || snapshot.id,
    category: data.category || 'Reflexión',
    readingTime: data.readingTime || 'Lectura',
    image: data.coverImage || data.image || 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
    description: data.shortDescription || data.description || '',
    chapters: Array.isArray(data.chapters) ? data.chapters : [],
    pages: Array.isArray(data.pages) ? data.pages : [],
    status: data.status || 'draft',
    updatedAtMs: Number(data.updatedAtMs || 0)
  };
}

function sortByUpdatedAt(items) {
  return [...items].sort((a, b) => Number(b.updatedAtMs || 0) - Number(a.updatedAtMs || 0));
}

export async function getPublishedStories() {
  if (!firebaseReady || !db) return localStories;

  try {
    const publishedQuery = query(collection(db, 'stories'), where('status', '==', 'published'));
    const snapshot = await getDocs(publishedQuery);
    const firebaseStories = snapshot.docs.map(normalizeStory);
    return firebaseStories.length ? sortByUpdatedAt(firebaseStories) : localStories;
  } catch (error) {
    console.error('No se pudieron cargar historias desde Firebase.', error);
    return localStories;
  }
}

export async function getPublishedStoryBySlug(slug) {
  const publishedStories = await getPublishedStories();
  return publishedStories.find((story) => story.slug === slug) || null;
}
