import { addDoc, collection, deleteDoc, doc, getDoc, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase.js';

const LIKE_CLIENT_KEY = 'sembrando_esperanza_like_client_id';

function getLikeClientId() {
  if (typeof window === 'undefined') return '';

  const existingId = window.localStorage.getItem(LIKE_CLIENT_KEY);
  if (existingId) return existingId;

  const newId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  window.localStorage.setItem(LIKE_CLIENT_KEY, newId);
  return newId;
}

function refs(storyId, likeClientId) {
  const statsRef = doc(db, 'storyReactions', storyId);
  const likeRef = likeClientId ? doc(db, 'storyReactions', storyId, 'likes', likeClientId) : null;
  const commentsRef = collection(db, 'storyReactions', storyId, 'comments');
  return { statsRef, likeRef, commentsRef };
}

export function listenToStoryStats(storyId, callback) {
  if (!db || !storyId) {
    callback({ likeCount: 0 });
    return () => {};
  }

  return onSnapshot(doc(db, 'storyReactions', storyId), (snapshot) => {
    callback({ likeCount: Number(snapshot.data()?.likeCount || 0) });
  });
}

export function listenToUserLike(storyId, callback) {
  const likeClientId = getLikeClientId();

  if (!db || !storyId || !likeClientId) {
    callback(false);
    return () => {};
  }

  return onSnapshot(doc(db, 'storyReactions', storyId, 'likes', likeClientId), (snapshot) => {
    callback(snapshot.exists());
  });
}

export function listenToComments(storyId, callback) {
  if (!db || !storyId) {
    callback([]);
    return () => {};
  }

  const commentsQuery = query(
    collection(db, 'storyReactions', storyId, 'comments'),
    orderBy('createdAtMs', 'desc'),
    limit(30)
  );

  return onSnapshot(commentsQuery, (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
  });
}

export async function toggleStoryLike(storyId) {
  const likeClientId = getLikeClientId();
  if (!db || !storyId || !likeClientId) throw new Error('No se pudo registrar el me gusta.');

  const { statsRef, likeRef } = refs(storyId, likeClientId);

  await runTransaction(db, async (transaction) => {
    const statsSnapshot = await transaction.get(statsRef);
    const likeSnapshot = await transaction.get(likeRef);
    const currentCount = Number(statsSnapshot.data()?.likeCount || 0);

    if (likeSnapshot.exists()) {
      transaction.delete(likeRef);
      transaction.set(statsRef, { likeCount: Math.max(0, currentCount - 1), updatedAt: serverTimestamp() }, { merge: true });
    } else {
      transaction.set(likeRef, {
        likeClientId,
        createdAt: serverTimestamp()
      });
      transaction.set(statsRef, { likeCount: currentCount + 1, updatedAt: serverTimestamp() }, { merge: true });
    }
  });
}

export async function addStoryComment(storyId, user, text) {
  const cleanText = String(text || '').trim();
  if (!db || !storyId || !user?.uid) throw new Error('Debes iniciar sesión para comentar.');
  if (!cleanText) return;

  const statsRef = doc(db, 'storyReactions', storyId);
  const commentsRef = collection(db, 'storyReactions', storyId, 'comments');

  await setDoc(statsRef, { updatedAt: serverTimestamp() }, { merge: true });
  await addDoc(commentsRef, {
    text: cleanText,
    uid: user.uid,
    displayName: user.displayName || 'Usuario',
    photoURL: user.photoURL || '',
    createdAt: serverTimestamp(),
    createdAtMs: Date.now()
  });
}

export async function removeStoryComment(storyId, commentId, user) {
  if (!db || !storyId || !commentId || !user?.uid) return;

  const commentRef = doc(db, 'storyReactions', storyId, 'comments', commentId);
  const snapshot = await getDoc(commentRef);
  if (snapshot.data()?.uid === user.uid) {
    await deleteDoc(commentRef);
  }
}
