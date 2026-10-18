import { ApiError } from "../utils/apiError.util.js";
import {
  findAll,
  findById,
  findBySlug,
  create,
  update,
  remove,
} from "../models/category.model.js";

const slugify = (text) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// "", null, undefined -> null (top-level); otherwise a positive whole number
const cleanParentId = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new ApiError(400, "Invalid parent_id");
  }
  return n;
};

const cleanDescription = (value) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

export const createCategory = async ({ name, parent_id, description } = {}) => {
  const cleanName = typeof name === "string" ? name.trim() : "";
  if (!cleanName) throw new ApiError(400, "Category name is required");

  const slug = slugify(cleanName);
  if (!slug) {
    throw new ApiError(400, "Category name must contain letters or numbers");
  }
  if (await findBySlug(slug)) {
    throw new ApiError(409, "Category already exists");
  }

  const parentId = cleanParentId(parent_id);
  if (parentId && !(await findById(parentId))) {
    throw new ApiError(400, "Parent category not found");
  }

  const id = await create({
    name: cleanName,
    slug,
    parent_id: parentId,
    description: cleanDescription(description),
  });
  return findById(id);
};

export const getCategories = async () => findAll();

export const getCategoryById = async (id) => {
  const categoryId = Number(id);
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    throw new ApiError(400, "Invalid category id");
  }
  const category = await findById(categoryId);
  if (!category) throw new ApiError(404, "Category not found");
  return category;
};

export const updateCategory = async (id, data = {}) => {
  const existing = await getCategoryById(id);
  const fields = {};

  if (data.name !== undefined) {
    const name = typeof data.name === "string" ? data.name.trim() : "";
    if (!name) throw new ApiError(400, "Category name cannot be empty");

    const slug = slugify(name);
    if (!slug) {
      throw new ApiError(400, "Category name must contain letters or numbers");
    }

    const sameSlug = await findBySlug(slug);
    if (sameSlug && sameSlug.id !== existing.id) {
      throw new ApiError(409, "Category already exists");
    }
    fields.name = name;
    fields.slug = slug;
  }

  if (data.parent_id !== undefined) {
    const parentId = cleanParentId(data.parent_id);
    if (parentId) {
      if (parentId === existing.id) {
        throw new ApiError(400, "A category cannot be its own parent");
      }
      if (!(await findById(parentId))) {
        throw new ApiError(400, "Parent category not found");
      }
    }
    fields.parent_id = parentId;
  }

  if (data.description !== undefined) {
    fields.description = cleanDescription(data.description);
  }

  if (Object.keys(fields).length === 0) {
    throw new ApiError(400, "Nothing to update");
  }

  await update(existing.id, fields);
  return findById(existing.id);
};

export const deleteCategory = async (id) => {
  const existing = await getCategoryById(id);
  try {
    await remove(existing.id);
  } catch (error) {
    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      throw new ApiError(
        409,
        "Category has products, move or deactivate them first",
      );
    }
    throw error;
  }
};
