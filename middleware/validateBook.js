const ALLOWED_LANGUAGES = ['en', 'fr', 'rw'];

// Fields that are computed by the system and must never be set via the API.
// savesCount is incremented/decremented when users save or remove a book.
// Only savesCount is blocked — rating is a seed value that admins set
// manually from trusted sources (e.g. Amazon, Goodreads) on create/update.
const PROTECTED_FIELDS = ['savesCount'];

const validateBook = (req, res, next) => {
  // ── Block any attempt to set protected computed fields ────────────────────
  const forbidden = PROTECTED_FIELDS.filter((f) => req.body[f] !== undefined);
  if (forbidden.length > 0) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: forbidden.map((f) => `${f} cannot be set manually.`),
    });
  }

  const {
    title,
    authors,
    description,
    categories,
    language,
    isbn,
    publisher,
    publishedDate,
    coverImage,
    pdfUrl,
    pages,
    edition,
    featured,
    rating
  } = req.body;

  const errors = [];

  // ---------- Required fields ----------

  if (title === undefined || title === null || title === '') {
    errors.push('title is required.');
  } else if (typeof title !== 'string') {
    errors.push('title must be a string.');
  }

  if (authors === undefined || authors === null) {
    errors.push('authors is required.');
  } else if (!Array.isArray(authors) || authors.length === 0) {
    errors.push('authors must be a non-empty array.');
  } else if (!authors.every((a) => typeof a === 'string' && a.trim() !== '')) {
    errors.push('authors must be an array of non-empty strings.');
  }

  if (language === undefined || language === null || language === '') {
    errors.push('language is required.');
  } else if (!ALLOWED_LANGUAGES.includes(language)) {
    errors.push(`language must be one of: ${ALLOWED_LANGUAGES.join(', ')}`);
  }

  if (isbn === undefined || isbn === null || isbn === '') {
    errors.push('isbn is required.');
  } else if (typeof isbn !== 'string') {
    errors.push('isbn must be a string.');
  }

  // ---------- Optional fields (only checked when provided) ----------

  if (description !== undefined && typeof description !== 'string') {
    errors.push('description must be a string.');
  }

  if (categories !== undefined) {
    if (!Array.isArray(categories) || !categories.every((c) => typeof c === 'string')) {
      errors.push('categories must be an array of strings.');
    }
  }

  if (publisher !== undefined && typeof publisher !== 'string') {
    errors.push('publisher must be a string.');
  }

  if (publishedDate !== undefined) {
    const parsedDate = new Date(publishedDate);
    if (isNaN(parsedDate.getTime())) {
      errors.push('publishedDate must be a valid date.');
    }
  }

  const isValidUrl = (value) => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  };

  if (coverImage !== undefined && coverImage !== '') {
    if (typeof coverImage !== 'string') {
      errors.push('coverImage must be a string.');
    } else if (!isValidUrl(coverImage)) {
      errors.push('coverImage must be a valid URL.');
    }
  }

  if (pdfUrl !== undefined && pdfUrl !== '') {
    if (typeof pdfUrl !== 'string') {
      errors.push('pdfUrl must be a string.');
    } else if (!isValidUrl(pdfUrl)) {
      errors.push('pdfUrl must be a valid URL.');
    }
  }

  if (featured !== undefined && typeof featured !== 'boolean') {
    errors.push('featured must be true or false.');
  }

  if (pages !== undefined) {
    if (typeof pages !== 'number' || !Number.isInteger(pages) || pages < 0) {
      errors.push('pages must be a non-negative integer.');
    }
  }

  if (edition !== undefined && typeof edition !== 'string') {
    errors.push('edition must be a string.');
  }

  if (rating !== undefined) {
    if (typeof rating !== 'number' || rating < 0 || rating > 5) {
      errors.push('rating must be a number between 0 and 5.');
    }
  }

  // ---------- Result ----------

  if (errors.length > 0) {
    return res.status(400).json({
      message: 'Validation failed',
      errors
    });
  }

  next();
};

module.exports = validateBook;