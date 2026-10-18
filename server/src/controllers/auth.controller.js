import { asyncHandler } from '../utils/asyncHandler.util.js';
import { registerUser, loginUser } from '../services/auth.service.js';
import { success } from 'zod';

// register
export const register = asyncHandler(async (req, resp) => {
 const { user, token } = await registerUser(req.body)
 resp.status(200).json({
    success: true,
    message: "users create successfully",
    user,
    token
 })

} )

// login
export const login = asyncHandler (async (req, resp) => {
    const { email, password } = req.body;
    const { user, token } = await loginUser(email, password)

    resp.status(200).json({
        success:true,
        message: "Login successfully",
        user,
        token
    })
})

//get me

export const getMe = asyncHandler(async(req, resp) => {
    resp.status(200).json({
        success: true,
        user: req.user
    })
})
