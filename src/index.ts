import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";

const API_KEY = process.env.QWEATHER_API_KEY;
const QWEATHER_API = "https://devapi.qweather.com/v7/weather/7d";
const USER_AGENT = "weather-app/1.0";

const server = new McpServer({
  name: "weather",
  version: "1.0.0",
});

interface WeatherResponse {
  code: string;
  updateTime: string;
  fxLink: string;
  daily: Daily[];
}

interface Daily {
  fxDate: string;
  sunrise: string;
  sunset: string;
  moonrise: string;
  moonset: string;
  tempMax: string;
  tempMin: string;
  iconDay: string;
  textDay: string;
  iconNight: string;
  textNight: string;
  wind360Day: string;
  windDirDay: string;
  windScaleDay: string;
  windSpeedDay: string;
  wind360Night: string;
  windDirNight: string;
  windScaleNight: string;
  windSpeedNight: string;
  humidity: string;
  precip: string;
  pressure: string;
  vis: string;
  cloud: string;
  uvIndex: string;
}

async function makeWeatherReqeust<T>(url: string): Promise<T | null> {
  const headers = {
    "X-QW-Api-Key": API_KEY || "",
    "User-Agent": USER_AGENT,
    // Accept: "application/geo+json",
  };

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error(error);
    return null;
  }
}

server.tool(
  "get-forecast",
  "获取天气预报",
  {
    longitude: z
      .number()
      .min(-180)
      .max(180)
      .describe("The longitude of the location"),
    latitude: z
      .number()
      .min(-90)
      .max(90)
      .describe("The latitude of the location"),
  },
  async ({ longitude, latitude }) => {
    const weatherURL = `${QWEATHER_API}?location=${longitude.toFixed(
      2
    )},${latitude.toFixed(2)}`;
    const response = await makeWeatherReqeust<WeatherResponse>(weatherURL);
    if (!response) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to retrieve coordinates: ${longitude}, ${latitude}. Response: ${response}`,
          },
        ],
      };
    }
    const daily = response.daily || [];
    if (daily.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No forecast periods available",
          },
        ],
      };
    }

    // Format forecast periods
    const formattedForecast = daily.map((day: Daily) =>
      [
        `**日期: ${day.fxDate}**`,
        `温度: ${day.tempMin} ${day.tempMax}`,
        `风: ${day.windDirDay} ${day.windScaleDay}`,
        `天气: 白天${day.textDay}，夜晚${day.textNight}`,
        "---",
      ].join("\n")
    );

    const forecastText = `Current time is ${new Date()}, forecast for ${latitude}, ${longitude}:\n\n${formattedForecast.join(
      "\n"
    )}`;

    return {
      content: [
        {
          type: "text",
          text: forecastText,
        },
      ],
    };
  }
);

// stdio
// import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
// async function main() {
//   const transport = new StdioServerTransport();
//   await server.connect(transport);
//   console.error("Weather MCP Server running on stdio");
// }

// main().catch((error) => {
//   console.error("Fatal error in main():", error);
//   process.exit(1);
// });

// sse
import express from "express";
const app = express();

let transport: SSEServerTransport | null = null;
app.get("/sse", (req, res) => {
  transport = new SSEServerTransport("/messages", res);
  server.connect(transport);
});

app.post("/messages", (req, res) => {
  if (transport) {
    transport.handlePostMessage(req, res);
  }
});

app.listen(3000);
