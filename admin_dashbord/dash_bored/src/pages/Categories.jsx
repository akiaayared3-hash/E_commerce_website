import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Tags } from "lucide-react";
import { apiRequest } from "../../src/lib/api.js";
import Modal from "./Modal.jsx";
import "./css/AdminPages.css";

// Must match app.js:
// app.use("/api/category", categoryRoutes);
const ENDPOINT = "/api/category";

const EMPTY = { name: "", description: "" };

// Accept supported API response shapes and reject invalid ones.
const toList = (res) => {
  if (Array.isArray(res)) return res;

  const list = res?.data ?? res?.categories;

  if (Array.isArray(list)) return list;

  // Some APIs wrap the list inside data.categories.
  if (Array.isArray(res?.data?.categories)) {
    return res.data.categories;
  }

  throw new Error("Invalid categories response from server.");
};

const getErrorMessage = (err, fallback) =>
  typeof err?.message === "string" && err.message.trim()
    ? err.message
    : fallback;

const banner = {
  background: "#fee2e2",
  color: "#b91c1c",
  border: "1px solid #fecaca",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 14,
  marginBottom: 16,
};

export default function Categories() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async (signal) => {
    setError("");

    try {
      const res = await apiRequest(ENDPOINT, { signal });

      if (signal?.aborted) return;

      const list = toList(res);

      // Prevent malformed records from breaking rendering.
      const validItems = list.filter(
        (item) =>
          item &&
          (typeof item.id === "string" ||
            (typeof item.id === "number" && Number.isFinite(item.id))) &&
          typeof item.name === "string",
      );

      setItems(validItems);
    } catch (err) {
      if (err?.name !== "AbortError" && !signal?.aborted) {
        setError(getErrorMessage(err, "Failed to load categories."));
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);

    return () => controller.abort();
  }, [load]);

  const openForm = (value) => {
    setFormError("");
    setForm({
      ...EMPTY,
      ...value,
      name: value.name ?? "",
      description: value.description ?? "",
    });
  };

  const setField = (key) => (e) => {
    const value = e.target.value;

    setForm((current) => (current ? { ...current, [key]: value } : current));
  };

  const refreshCategories = async () => {
    setRefreshing(true);
    await load();
  };

  const save = async (e) => {
    e.preventDefault();

    if (saving || !form) return;

    const name = form.name.trim();
    const description = (form.description ?? "").trim();

    if (!name) {
      setFormError("Category name cannot be empty.");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const body = { name, description };

      if (form.id != null) {
        await apiRequest(`${ENDPOINT}/${encodeURIComponent(form.id)}`, {
          method: "PATCH",
          body,
        });
      } else {
        await apiRequest(ENDPOINT, {
          method: "POST",
          body,
        });
      }

      setForm(null);
      await refreshCategories();
    } catch (err) {
      setFormError(getErrorMessage(err, "Failed to save category."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (category) => {
    if (deletingId !== null || saving) return;

    if (!window.confirm(`Delete "${category.name}"?`)) {
      return;
    }

    setError("");
    setDeletingId(category.id);

    try {
      await apiRequest(`${ENDPOINT}/${encodeURIComponent(category.id)}`, {
        method: "DELETE",
      });

      await refreshCategories();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete category."));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div className="pg-head">
        <div className="sa-page-head">
          <h1>Categories</h1>
          <p>Organize your products into groups</p>
        </div>

        <button
          className="sa-btn primary"
          onClick={() => openForm({ ...EMPTY })}
          disabled={saving || deletingId !== null}
        >
          <Plus size={16} /> Add Category
        </button>
      </div>

      {error && (
        <div style={banner} role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <p className="pg-empty">Loading categories...</p>
      ) : (
        <section className="pg-cards">
          {items.map((c) => {
            const count = c.product_count ?? c.products_count ?? c.productCount;

            return (
              <div className="sa-card pg-cat" key={c.id}>
                <span className="sa-stat-icon blue">
                  <Tags size={18} />
                </span>

                <h3>{c.name}</h3>
                <p>{c.description || "No description"}</p>

                <div className="pg-cat-foot">
                  <span>
                    {typeof count === "number" && Number.isFinite(count)
                      ? `${count} products`
                      : ""}
                  </span>

                  <div>
                    <button
                      className="sa-icon-btn"
                      aria-label={`Edit ${c.name}`}
                      disabled={deletingId !== null || saving}
                      onClick={() => openForm(c)}
                    >
                      <Pencil size={16} />
                    </button>

                    <button
                      className="sa-icon-btn danger"
                      aria-label={`Delete ${c.name}`}
                      disabled={deletingId !== null || saving}
                      onClick={() => remove(c)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {items.length === 0 && !error && (
            <p className="pg-empty">No categories yet.</p>
          )}

          {refreshing && <p className="pg-empty">Refreshing categories...</p>}
        </section>
      )}

      {form && (
        <Modal
          title={form.id != null ? "Edit category" : "Add category"}
          onClose={() => {
            if (!saving) {
              setForm(null);
              setFormError("");
            }
          }}
        >
          <form className="pg-form" onSubmit={save}>
            {formError && (
              <div style={banner} role="alert">
                {formError}
              </div>
            )}

            <label className="pg-field">
              Name
              <input
                value={form.name}
                onChange={setField("name")}
                required
                maxLength={150}
                disabled={saving}
              />
            </label>

            <label className="pg-field">
              Description
              <textarea
                rows="3"
                value={form.description}
                onChange={setField("description")}
                disabled={saving}
              />
            </label>

            <div className="pg-form-actions">
              <button
                type="button"
                className="sa-btn ghost"
                onClick={() => {
                  setForm(null);
                  setFormError("");
                }}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="sa-btn primary"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save category"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
