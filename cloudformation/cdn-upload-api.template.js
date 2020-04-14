//TODO: 
//  - API Key / Authorization
//  -

const cf = require('@mapbox/cloudfriend');

const Parameters = {
    BucketName: {
        Type :"String",
        Description: "The name of the existing bucket where the images will be stored"
    },

};

const Conditions = {

};

const Resources = {
    LambdaServiceRole: {
        Type: "AWS::IAM::Role",
        Properties: {
            RoleName: "LambdaServiceRole",
            AssumeRolePolicyDocument: {
                Version: "2012-10-17",
                Statement: [{
                    Sid: "",
                    Effect: "Allow",
                    Principal: {
                        Service: "lambda.amazonaws.com"
                    },
                    Action: "sts:AssumeRole"
                }]
            },
            ManagedPolicyArns: ["arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs"],
            Policies: [{
                PolicyName: "LambdaServiceRolePolicy",
                PolicyDocument: {
                    Version: "2012-10-17",
                    Statement: [{
                        Action: ["s3:GetBucket*","s3:GetObject*","s3:List*", "s3:Put*"],
                        Resource: [cf.join("", ["arn:aws:s3:::", cf.ref("BucketName"), "/*"]),cf.join("", ["arn:aws:s3:::", cf.ref("BucketName")])],
                        Effect: "Allow"
                    }]
                }
            }]
        }  //probably doesn't need editing rn
    },


    APIPostServiceRole: {
        Type: "AWS::IAM::Role",
        Properties: {
            RoleName: "LambdaAPIServiceRole",
            AssumeRolePolicyDocument: {
                Version: "2012-10-17",
                Statement: [{
                    Sid: "",
                    Effect: "Allow",
                    Principal: {
                        Service: "apigateway.amazonaws.com"
                    },
                    Action: "sts:AssumeRole"
                }]
            },
            ManagedPolicyArns: ["arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs"],
            Policies: [{
                PolicyName: "API_Service_Role_Policy",
                PolicyDocument: {
                    Version: "2012-10-17",
                    Statement: [{
                        Action: "lambda:InvokeFunction",
                        Resource: [{"Fn::GetAtt": ["APIPostFunction", "Arn"]}, {"Fn::GetAtt": ["APIGetFunction", "Arn"]}],
                        Effect: "Allow"
                    }
                    ]
                }
            }]
        }
    },

    APIPostFunction: {
        Type: "AWS::Lambda::Function",
        Properties: {
            FunctionName: cf.join("-", [cf.stackName, "upload"]),
            Description: "Function to Upload Image from S3 Bucket",
            Code: {
                "ZipFile": cf.join("\n", [
                    "const AWS = require('aws-sdk');",
                    "var s3 = new AWS.S3();exports.handler = (event, context, callback) => {",
                    "let encodedImage =JSON.parse(event.body).image;",
                    "let decodedImage = Buffer.from(encodedImage, 'base64');",
                    cf.sub("var filePath = '${AWS::StackName}/uploads/' + event.queryStringParameters.filename;"),
                    cf.sub("var params = {'Body': decodedImage,'Bucket': '${BucketName}','Key': filePath};", {"BucketName": cf.ref("BucketName")}),
                    "s3.upload(params, function(err, data){",
                    "if(err) {callback(err, null);} else {",
                    cf.sub("let response = {'statusCode': 200,'headers': {'my_header': 'my_value'},'body': 'https://cdn.hotosm.org/${BucketName}/${AWS::StackName}/uploads/' + JSON.stringify(data.Key),'isBase64Encoded': false};", {"BucketName": cf.ref("BucketName")}),
                    "callback(null, response);}});};"
                ])
            },
            Handler: "index.handler",
            Runtime: "nodejs12.x",
            MemorySize: 1024,
            Role: cf.getAtt("LambdaServiceRole", "Arn"),
            Timeout : 60
        } 
    },

    APIGetFunction: {
        Type: "AWS::Lambda::Function",
        Properties: {
            FunctionName: cf.join("-", [cf.stackName, "get-image"]),
            Description: "Function to get image URI from S3 Bucket",
            Code: {
                "ZipFile": cf.join("\n", [
                    "const AWS = require('aws-sdk');",
                    "var s3 = new AWS.S3();exports.handler = (event, context, callback) => {",
                    cf.sub("var params = {'Bucket': '${BucketName}', 'Key': event.queryStringParameters.key};", {"BucketName": cf.ref("BucketName")}),
                    "s3.getObject(params, function(err, data){",
                    "if(err) {callback(err, null);} else {",
                    "let response = {'statusCode': 200, 'headers': {'my_header': 'my_value'},",
                    "'body': JSON.stringify(data), 'isBase64Encoded': false};",
                    "callback(null, response);}});};"
                ])
            },
            Handler: "index.handler",
            Runtime: "nodejs12.x",
            MemorySize: 1024,
            Role: cf.getAtt("LambdaServiceRole", "Arn"),
            Timeout : 60
        }
    },

    RestAPI: {
        Type: "AWS::ApiGateway::RestApi",
        Properties: {
            Description: "API to upload images to HOTOSM CDN",
            Name: "CDN Upload API",
            EndpointConfiguration: {"Types" : ["REGIONAL"]},
            ApiKeySourceType: "HEADER"
        }
    },

    ApiGatewayResourceUpload: {
        Type: "AWS::ApiGateway::Resource",
        Properties: {
            ParentId: cf.getAtt("RestAPI", "RootResourceId"),
            PathPart: 'upload',
            RestApiId: cf.ref("RestAPI")
        }
    },

    ApiGatewayResourceGetImage: {
        Type: "AWS::ApiGateway::Resource",
        Properties: {
            ParentId: cf.getAtt("RestAPI", "RootResourceId"),
            PathPart: 'get-image',
            RestApiId: cf.ref("RestAPI")
        }
    },

    UploadApiMethod: {
        Type: "AWS::ApiGateway::Method",
        Properties: {
            ApiKeyRequired: true,
            AuthorizationType: "NONE",
            HttpMethod: "POST",
            Integration: {
                ConnectionType: "INTERNET",
                IntegrationHttpMethod: "POST",
                TimeoutInMillis: 29000,
                Type: "AWS_PROXY",                                              //TODO the Uri properly
                Uri: cf.sub('arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${APIPostFunction.Arn}/invocations')
            },
            OperationName: 'UploadImage',
            ResourceId: cf.ref("ApiGatewayResourceUpload"),
            RestApiId: cf.ref("RestAPI")
        }
    },
    
    GetApiMethod: {
        Type: "AWS::ApiGateway::Method",
        Properties: {
            ApiKeyRequired: true,
            AuthorizationType: "NONE",
            HttpMethod: "GET",
            Integration: {
                ConnectionType: "INTERNET",
                IntegrationHttpMethod: "GET",
                TimeoutInMillis: 29000,
                Type: "AWS_PROXY",                                              //TODO the Uri properly
                Uri: cf.sub('arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${APIGetFunction.Arn}/invocations')
            },
            OperationName: 'UploadImage',
            ResourceId: cf.ref("ApiGatewayResourceGetImage"),
            RestApiId: cf.ref("RestAPI")
        }
    },

    ApiGatewayModel: {
        Type: "AWS::ApiGateway::Model",
        Properties: {
            ContentType: 'application/json',
            RestApiId: cf.ref("RestAPI"),
            Schema: {}
        }
    },

    ApiGatewayStage: {
        Type: "AWS::ApiGateway::Stage",
        Properties: {
            DeploymentId: cf.ref("ApiGatewayDeployment"),
            Description: cf.join(" ", ["CDN Upload API Stage", cf.stackName]),
            RestApiId: cf.ref("RestAPI"),
            StageName: cf.stackName
        }
    },

    ApiGatewayDeployment: {
        Type: "AWS::ApiGateway::Deployment",
        DependsOn: ["UploadApiMethod", "GetApiMethod"],
        Properties: {
            Description: "CDN Upload API Deployment",
            RestApiId: cf.ref("RestAPI"),
            "StageName": "DummyStage"
        }
    },


    LambdaPermissionsUpload: {
        Type: "AWS::Lambda::Permission",
        Properties: {
            Action: "lambda:Invoke",
            FunctionName: cf.ref("APIPostFunction"),
            Principal: "apigateway.amazonaws.com",
            SourceArn: cf.join("", ["arn:aws:execute-api:", cf.region, ":", cf.accountId, ":", cf.ref("RestAPI"), "/*/POST/upload"])
        }
    },

    LambdaPermissionsGet: {
        Type: "AWS::Lambda::Permission",
        Properties: {
            Action: "lambda:Invoke",
            FunctionName: cf.ref("APIGetFunction"),
            Principal: "apigateway.amazonaws.com",
            SourceArn: cf.join("", ["arn:aws:execute-api:", cf.region, ":", cf.accountId, ":", cf.ref("RestAPI"), "/*/GET/get-image"])
        }
    },


    // GetImageLogGroup: {
    //     Type: "AWS::Logs::LogGroup",
    //     DependsOn: cf.ref("APIFunction"),
    //     Properties: {
    //         LogGroupName: cf.join("", ["/aws/lambda/", cf.stackName, "-", cf.ref("APIFunction")])
    //     }
    // },

    // ApiGatewayCloudWatchLogsRole: {
    //     Type: "AWS::IAM::Role",
    //     Properties: {
    //         AssumeRolePolicyDocument: {
    //             Version: "2012-10-17",
    //             Statement: [{
    //                 Effect: "Allow",
    //                 Principal: { "Service": ["apigateway.amazonaws.com"] },
    //                 Action: ["sts:AssumeRole"]
    //             }]
    //         },
    //         Policies: [{
    //           PolicyName: "API_GW_Logs_Policy",
    //           PolicyDocument: {
    //             Version: "2012-10-17",
    //             Statement: [{
    //               Effect: "Allow",
    //               Action: [
    //                 "logs:CreateLogGroup",
    //                 "logs:CreateLogStream",
    //                 "logs:DescribeLogGroups",
    //                 "logs:DescribeLogStreams",
    //                 "logs:PutLogEvents",
    //                 "logs:GetLogEvents",
    //                 "logs:FilterLogEvents"
    //               ],
    //               Resource: "*"
    //             }]
    //           }
    //         }]
    //     }
    // }
};

const Outputs = {
  
};

module.exports = { Parameters, Resources, Conditions, Outputs };