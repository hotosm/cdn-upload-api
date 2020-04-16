# CDN Uploader API

The CDN Uploader is a small API built on AWS API Gateway and Lambda. It has two methods:

## Upload

`POST /upload`

Upload a base64 encoded image to the S3 Bucket

### Parameters

`x-api-key` (Header)
> An api key 

`filename` (query string)
> the name of the file as it will be saved in the S3 bucket (aka key)

`body`
> base64 encoded image as JSON in this format:
```
{
  "image": {
    "mime": "image/jpeg",
    "data": "<base64 encoding>"
  }
}
```

### Example 

```
curl -X POST -H "x-api-key: <api-key>" -H "Content-Type: application/json" <invoke-endpoint-url>/upload?filename=test-curl1.png -d '{
  "image": {
    "mime": "image/png",
    "data": "<base64 string>"
  }
}'
```

### Responses

**200** File upload began successfully with the URI of the file. 

## Get Image

`GET /get-image`

Pulls the image directly from the s3 bucket

### Parameters

`x-api-key` (Header)
> An api key 

`Bucket` (query string)
> The name of the bucket

`Key` (query string)
> the filename

### Responses

**200** The image is returned


## Deployment to AWS

Requirements: [cfn-config](https://github.com/mapbox/cfn-config)

```
cfn-config create <stack-name> cloudformation/cdn-upload-api.template.js -t <template-bucket> -c <config-bucket>
```

The `template-bucket` and `config-bucket` can be the same. You will be prompted for two parameters:

BucketName: The name of an existing bucket where the images will be uploaded.
BucketPrefix: Subfolder name in the bucket where the images will be stored. 