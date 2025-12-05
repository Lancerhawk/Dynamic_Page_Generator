"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAnthropicClient = getAnthropicClient;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, "../.env") });
function getAnthropicClient(provider = 'anthropic') {
    if (provider === 'openrouter') {
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            throw new Error('OPENROUTER_API_KEY is not set in environment variables');
        }
        return new sdk_1.default({
            apiKey: apiKey,
            baseURL: 'https://openrouter.ai/api/v1',
        });
    }
    else {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
        }
        return new sdk_1.default({
            apiKey: apiKey,
        });
    }
}
