import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface IBlogPost extends Document {
	title: string;
	slug: string;
	excerpt: string;
	content: string; // raw markdown
	coverImage?: string;
	tags: string[];
	published: boolean;
	publishedAt?: Date;
	createdAt: Date;
	updatedAt: Date;
}

const blogPostSchema = new Schema<IBlogPost>(
	{
		title: { type: String, required: true, trim: true },
		slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
		excerpt: { type: String, required: true, trim: true },
		content: { type: String, required: true },
		coverImage: { type: String },
		tags: { type: [String], default: [] },
		published: { type: Boolean, default: false },
		publishedAt: { type: Date }
	},
	{ timestamps: true }
);

blogPostSchema.index({ slug: 1 }, { unique: true });
blogPostSchema.index({ published: 1, publishedAt: -1 });
blogPostSchema.index({ tags: 1 });

export const BlogPost: Model<IBlogPost> =
	(mongoose.models.BlogPost as Model<IBlogPost>) ??
	mongoose.model<IBlogPost>('BlogPost', blogPostSchema);
