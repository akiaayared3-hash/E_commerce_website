import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Folder,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { list, create, update, remove } from "../lib/categoryApi.js";
import "./css/CategoryManagePage.css";

export default function CategoryManagePage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const isEditing = editingId !== null;
  const busy = saving || deletingId !== null;

  const loadCategories = useCallback(async ({ initial = false } = {}) => {
    if (initial) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError("");

    try {
      const data = await list();

      if (!Array.isArray(data)) {
        throw new Error("Unexpected categories response from the server.");
      }

      setCategories(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load categories.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCategories({ initial: true });
  }, [loadCategories]);

  function resetForm() {
    setName("");
    setEditingId(null);
    setError("");
    setSuccess("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const cleanName = name.trim();

    if (!cleanName) {
      setError("Please enter a category name.");
      return;
    }

    if (cleanName.length > 100) {
      setError("Category name must be 100 characters or fewer.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      if (isEditing) {
        await update(editingId, cleanName);
        setSuccess("Category updated successfully.");
      } else {
        await create(cleanName);
        setSuccess("Category created successfully.");
      }

      setName("");
      setEditingId(null);

      await loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save category.");
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(category) {
    setName(category.name ?? "");
    setEditingId(category.id);
    setError("");
    setSuccess("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(category) {
    const confirmed = window.confirm(
      `Delete "${category.name}"? This action cannot be undone.`,
    );

    if (!confirmed) return;

    setDeletingId(category.id);
    setError("");
    setSuccess("");

    try {
      await remove(category.id);

      if (editingId === category.id) {
        setName("");
        setEditingId(null);
      }

      setSuccess(`"${category.name}" was deleted.`);
      await loadCategories();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not delete category.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="category-manage">
      <header className="category-manage__header">
        <div>
          <span className="category-manage__eyebrow">
            MULE FASHION BOUTIQUE
          </span>
          <h1>Categories</h1>
          <p>Organize your products into clear, easy-to-browse collections.</p>
        </div>

        <button
          type="button"
          className="category-manage__refresh"
          onClick={() => loadCategories()}
          disabled={loading || refreshing || busy}
        >
          <RefreshCw size={16} className={refreshing ? "is-spinning" : ""} />
          Refresh
        </button>
      </header>

      {error && (
        <div
          className="category-manage__alert category-manage__alert--error"
          role="alert"
        >
          <AlertCircle size={18} />
          <span>{error}</span>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setError("")}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div
          className="category-manage__alert category-manage__alert--success"
          role="status"
        >
          <Check size={18} />
          <span>{success}</span>
          <button
            type="button"
            aria-label="Dismiss message"
            onClick={() => setSuccess("")}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <section className="category-manage__panel">
        <div className="category-manage__panel-heading">
          <div className="category-manage__icon">
            {isEditing ? <Pencil size={20} /> : <Plus size={21} />}
          </div>
          <div>
            <h2>{isEditing ? "Edit category" : "Add a category"}</h2>
            <p>
              {isEditing
                ? "Update the name of this collection."
                : "Create a collection for your store products."}
            </p>
          </div>
        </div>

        <form className="category-manage__form" onSubmit={handleSubmit}>
          <label htmlFor="category-name">Category name</label>

          <div className="category-manage__form-row">
            <input
              id="category-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Men's Clothing"
              maxLength={100}
              autoComplete="off"
              required
              disabled={saving}
            />

            <button
              type="submit"
              className="category-manage__primary"
              disabled={saving || deletingId !== null || !name.trim()}
            >
              {saving ? (
                "Saving..."
              ) : isEditing ? (
                <>
                  <Check size={17} />
                  Save changes
                </>
              ) : (
                <>
                  <Plus size={17} />
                  Add category
                </>
              )}
            </button>

            {isEditing && (
              <button
                type="button"
                className="category-manage__secondary"
                onClick={resetForm}
                disabled={saving}
              >
                Cancel
              </button>
            )}
          </div>

          <p className="category-manage__hint">
            Use a clear name customers will understand.
          </p>
        </form>
      </section>

      <section className="category-manage__list-panel">
        <div className="category-manage__list-heading">
          <div>
            <h2>Your categories</h2>
            <p>Manage the collections available in your store.</p>
          </div>
          <span className="category-manage__count">
            {categories.length}{" "}
            {categories.length === 1 ? "category" : "categories"}
          </span>
        </div>

        {loading ? (
          <div className="category-manage__empty" role="status">
            <RefreshCw size={22} className="is-spinning" />
            <p>Loading categories...</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="category-manage__empty">
            <Folder size={32} />
            <h3>No categories yet</h3>
            <p>Create your first category to start organizing products.</p>
          </div>
        ) : (
          <div className="category-manage__table-wrap">
            <table className="category-manage__table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="category-manage__actions-heading">Actions</th>
                </tr>
              </thead>

              <tbody>
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td>
                      <div className="category-manage__category-cell">
                        <span className="category-manage__row-icon">
                          <Folder size={18} />
                        </span>
                        <span>{category.name}</span>
                      </div>
                    </td>

                    <td>
                      <div className="category-manage__actions">
                        <button
                          type="button"
                          className="category-manage__edit"
                          onClick={() => handleEdit(category)}
                          disabled={busy}
                          aria-label={`Edit ${category.name}`}
                        >
                          <Pencil size={15} />
                          Edit
                        </button>

                        <button
                          type="button"
                          className="category-manage__delete"
                          onClick={() => handleDelete(category)}
                          disabled={busy}
                          aria-label={`Delete ${category.name}`}
                        >
                          <Trash2 size={15} />
                          {deletingId === category.id
                            ? "Deleting..."
                            : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
