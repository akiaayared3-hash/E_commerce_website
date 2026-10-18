import { asyncHandler } from "../utils/asyncHandler.util.js";
import {
    createCategory,
    getCategories,
    getCategoryById,
    updateCategory,
    deleteCategory
} from '../services/category.service.js'
import { success } from "zod";


export const create = asyncHandler(async (req,resp) => {
    const category = await createCategory(req.body)
    resp.status(201).json({
      success: true,
      message: "Category create successfully",
      category,
    })
}) 

export const list = asyncHandler(async (req,resp) => {
    const categories = await getCategories()
    resp.status(200).json({
        success: true,
        count: categories.length,
        categories,
    })
}) 

export const getOne = asyncHandler(async(req, resp) => {
    const category = await getCategoryById(req.params.id) 
    resp.status(200).json({
        success: true,
        category,
    })
})

export const update = asyncHandler(async (req, resp) => {
    const category = await updateCategory(req.params.id, req.body)
    resp.status(200).json({
        success: true,
        message: "Category update successfully",
        category
    })
})

export const remove = asyncHandler(async(req, resp) => {
  await deleteCategory(req.params.id)
    resp.status(200).json({
        success: true,
        message: "Category remove successfully",

    })
})