import asyncHandler from "../utils/asyncHandler.js";
import apiError from "../utils/apiErrors.js"
import {User} from "../models/user.model.js";
import {uploadOnCloudinary}  from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/apiResponse.js";


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
        new ApiResponse(200, createdUser, "User registered Successfully")
    )

});

export { registerUser };