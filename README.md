# helmet-static

Create a static index.html for your sub pages with rendered helmet attributes

## How

Add a `helmet-static.js` to your root (or provide the config file path with `-c <path to config file>`), and at a minimum provide it the routes to process.

The default config is below and you can overide any of it by exporting it from your `helmet-static.js` file

```json
{
    "basePath": "./dist",
    "rootDocument": "index.html",
    "port": 3001,
    "rootUrl": "http://localhost:${port}",
    "waitTime": 200,
    "navigationTimeout": 30000,
    "includeExternal": false,
    "allowedExternalDomains": [],
    "routes": ["/"],
    "headless": true
}
```

## Example

Your build command will become

`<your usual build commands> && helmet-static`

If your config is

```json
{
    "routes": ["/foo", "/bar", "/bar/stuff"]
}
```

You will end up with an output of

```
/dist
  --> /foo
    --> index.html
  --> /bar
    --> index.html
    --> /stuff
      --> index.html
```
