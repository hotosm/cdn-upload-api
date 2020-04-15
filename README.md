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