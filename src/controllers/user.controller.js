import asyncHandler from "../utils/asyncHandler.js";
import apiError from "../utils/apiErrors.js"
import {User} from "../models/user.model.js";
import {uploadOnCloudinary}  from "../utils/cloudinary.js"
import  apiResponse  from "../utils/apiResponse.js";
import jwt from "jsonwebtoken"



const registerUser = asyncHandler(async(req, res) => {

    //get user data from req.body(frontend)
    //validate user data
    //check if user already exists in db
    //check for avatar image
    //uplode to cloudinary
    //user object in db (db.create)
    //store user in db
    //generate jwt token
    //remove password from response and refresh token
    //send response to frontend

    const { username, email, fullName, password } = req.body;

    console.log(req.body);
    if (!username || !email || !fullName || !password) {
        throw new apiError(400,"All fields are required");
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
        throw new apiError(409, "User already exists with this email or username");
    }

    req.files && console.log("req.files------------->>>>>>>>", req.files);

   const avatarLocalFile = req.files?.avatar[0]?.path;
    const coverImageLocalFile = req.files?.coverImage?.[0]?.path;
   if (!avatarLocalFile) {
       throw new apiError(400, "Avatar image is required");
   }

  const avtar = await uploadOnCloudinary(avatarLocalFile);
  const coverImage = await uploadOnCloudinary(coverImageLocalFile);

  if(!avtar){
    throw new apiError(500, "Could not upload avatar image, please try again later");
  }

 const user = await User.create({
   fullName,
   avatar: avtar.url,
   coverImage: coverImage?.url || "",
    username,
    password,
    email,
  });

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) {
        throw new apiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new apiResponse(200, createdUser, "User registered Successfully")
    )

});


const generateAccessAndRefereshTokens = async(userId) =>{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return {accessToken, refreshToken}


    } catch (error) {
        throw new apiError(500, "Something went wrong while generating referesh and access token")
    }
}

const loginUser = asyncHandler(async(req, res) => {
    //get user data from req.body(frontend)
    //username or email, password
    //validate user data
    //find user in db
    //password comparison
    //access and refresh token
    //send cookie
    // response to frontend
    const { username, email, password } = req.body;

    if ((!username && !email) || !password) {
        throw new apiError(400, "All fields are required");
    }

    const user = await User.findOne({ $or: [{ email }, { username }] });

    if (!user) {
        throw new apiError(404, "User not found with this email or username");
    }

    const isPasswordCorrect = await user.isPasswordCorrect(password);
    if (!isPasswordCorrect) {
        throw new apiError(401, "Password is incorrect");
    }

   const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new apiResponse(
            200, 
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged In Successfully"
        )
    )
});


const logoutUser = asyncHandler(async(req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1 
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new apiResponse(200, {}, "User logged Out"))
})


const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new apiError(401, "unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new apiError(401, "Invalid refresh token")
        }
    
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new apiError(401, "Refresh token is expired or used")

        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newRefreshToken} = await generateAccessAndRefereshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new apiResponse(
                200, 
                {accessToken, refreshToken: newRefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new apiError(401, error?.message || "Invalid refresh token")
    }

})


const changePassword = asyncHandler(async(req,res)=>{
    const {oldPassword, newPassword} = req.body
    if(!oldPassword || !newPassword){
        throw new apiError(400, "All fields are required")
    }

    const user = await User.findById(req.user._id)

    if(!user){
        throw new apiError(404, "User not found")
    }

    const isOldPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isOldPasswordCorrect){
        throw new apiError(401, "Old password is incorrect")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res.status(200).json(new apiResponse(200, {}, "Password changed successfully"))
})


const getCurrentUser = asyncHandler(async(req,res)=>{
    if(!req.user){
        throw new apiError(404, "User not found")
    }
    return res.status(200).json(new apiResponse(200, req.user, " current User fetched successfully"))
    
})

const updateUserDetails = asyncHandler(async(req, res) => {
    const { fullName, email } = req.body || {};
    console.log('updateUserDetails req.body:', req.body);

    if (!fullName || !email) {
        throw new apiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email: email
            }
        },
        {new: true}
        
    ).select("-password")

    return res
    .status(200)
    .json(new apiResponse(200, user, "User details updated successfully"))
});

const updateUserProfileImages = asyncHandler(async(req, res) => {
    const avatarLocalFile = req.files?.avatar?.[0]?.path;
    const coverImageLocalFile = req.files?.coverImage?.[0]?.path;

    if (!avatarLocalFile && !coverImageLocalFile) {
        throw new apiError(400, "Please provide avatar or cover image to update")
    }

    const avatar = avatarLocalFile && await uploadOnCloudinary(avatarLocalFile)
    const coverImage = coverImageLocalFile && await uploadOnCloudinary(coverImageLocalFile)

    if(!coverImage && !avatar){
        throw new apiError(500, "Could not upload avatar image, please try again later");
    }

   

  const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
              avatar:  avatar.url,
              coverImage: coverImage.url
            }
        },
        {new: true}
        
    ).select("-password")

    return res.status(200).json(new apiResponse(200, user, "User avatar and cover image updated successfully"))
});

export { registerUser , loginUser, logoutUser,refreshAccessToken, changePassword, getCurrentUser, updateUserDetails, updateUserProfileImages  };