import jwt from 'jsonwebtoken';
import ApiError from '../utils/apiError.js';

const authenticateToken = (req, res, next) => {
	const authHeader = req.headers['authorization'];
	const token = authHeader && authHeader.split(' ')[1];
	if (!token) {
		throw new ApiError(401, 'No token provided');
	}

	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		req.user = decoded;
		next();
	} catch (err) {
		if (err.name === 'TokenExpiredError')
			throw new ApiError(401, 'Token expired');
		throw new ApiError(401, 'Invalid token');
	}
};

export default authenticateToken;