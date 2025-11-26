import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

export function startServer() {
	app.get("/", (req, res) => {
		res.send("AI-Haikaru is awake and listening!");
	});

	app.get("/status", (req, res) => {
		res.json({
			status: "running",
			bot: "AI-Haikaru",
			service: "Uptime Keeper",
		});
	});

	app.listen(PORT, "0.0.0.0", () => {
		console.log(`[HTTP] Uptime Server is listening on port ${PORT}`);
	});
}
